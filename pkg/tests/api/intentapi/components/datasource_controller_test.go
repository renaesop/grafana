package components

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana/internal/components"
	"github.com/grafana/grafana/internal/components/datasource"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/kubectl/pkg/scheme"
)

func TestDatasourceController(t *testing.T) {
	s, c := setup(t)

	resource := "datasources"
	// TODO create testNamespace for tests
	testNamespace := "default"
	name := "test-datasource"
	body := &datasource.Datasource{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
		TypeMeta: metav1.TypeMeta{
			Kind:       "Datasource",
			APIVersion: "datasource.core.grafana/v1alpha1",
		},
		Spec: datasource.DatasourceSpec{
			Type:              "prometheus",
			Access:            "proxy",
			Url:               "http://localhost:1111/api/prom",
			User:              "test",
			Password:          "test",
			BasicAuth:         true,
			BasicAuthUser:     "admin",
			BasicAuthPassword: "test",
			WithCredentials:   false,
			IsDefault:         false,
			JsonData:          "",
			Version:           1,
			ReadOnly:          true,
		},
	}

	testCases := []struct {
		desc         string
		testScenario func() error
	}{
		{
			desc: "Test resource POST",
			testScenario: func() error {
				req := c.Post().
					Resource(resource).
					Namespace(testNamespace)
				req.Body(body)
				res := req.Do(context.Background())
				require.NoError(t, res.Error())

				defer func() {
					// delete object
					res := c.Delete().
						Resource(resource).
						Namespace(testNamespace).
						Name(name).
						Do(context.Background())
					require.NoError(t, res.Error())

					// make sure that the object is deleted
					assert.Eventually(t, func() bool {
						res = c.Get().
							Resource(resource).
							Namespace(testNamespace).
							Name(name).
							Do(context.Background())
						return res.Error() != nil
					}, 10*time.Second, 10*time.Millisecond)
				}()

				assert.Eventually(t, func() bool {
					// make sure that the object exists in store
					r := datasource.Datasource{}
					err := s.Get(context.Background(), types.NamespacedName{Name: name}, &r)
					fmt.Printf("$$$<<<<< %+v", r)
					return err == nil
				}, 10*time.Second, 250*time.Millisecond)

				return nil
			},
		},
	}

	for _, tc := range testCases {
		tc.testScenario()
	}

}

func setup(t *testing.T) (components.Store, *rest.RESTClient) {
	t.Helper()

	// Setup Grafana and its Database
	_, err := tracing.InitializeTracerForTest()
	require.NoError(t, err)

	// Enable intent API
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{"intentapi"},
		IntentAPIOpts: &testinfra.IntentAPIOpts{
			ServerCertFilePath:   os.Getenv("GRAFANA_TEST_INTENTAPI_SERVER_CERT_FILE_PATH"),
			ServerKeyFilePath:    os.Getenv("GRAFANA_TEST_INTENTAPI_SERVER_KEY_FILE_PATH"),
			BridgeKubeconfigPath: os.Getenv("GRAFANA_TEST_INTENTAPI_KUBEBRIDGE_KUBECONFIG_PATH"),
		},
	})

	_, store := testinfra.StartGrafana(t, dir, path)
	s := sqlstore.ProvideDataSourceSchemaStore(store)

	intentapiConfigPath := os.Getenv("GRAFANA_TEST_INTENTAPI_KUBECONFIG_PATH")
	intentapiConfigPath = filepath.Clean(intentapiConfigPath)

	_, err = os.Stat(intentapiConfigPath)
	require.NoError(t, err)

	restCfg, err := clientcmd.BuildConfigFromFlags("", intentapiConfigPath)
	require.NoError(t, err)

	restCfg.NegotiatedSerializer = scheme.Codecs.WithoutConversion()
	restCfg.APIPath = "/apis"
	groupName := "datasource.core.grafana"
	groupVersion := "v1alpha1"
	restCfg.GroupVersion = &schema.GroupVersion{
		Group:   groupName,
		Version: groupVersion,
	}

	cli, err := rest.RESTClientFor(restCfg)
	require.NoError(t, err)

	return s, cli
}
