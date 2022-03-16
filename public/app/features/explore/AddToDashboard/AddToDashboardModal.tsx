import React, { useState } from 'react';
import { Alert, Button, Modal, RadioButtonGroup } from '@grafana/ui';
import { FormProvider, useForm } from 'react-hook-form';
import { SaveToExistingDashboardDTO, SaveToNewDashboardDTO } from './addToDashboard';
import { SaveToNewDashboard } from './Forms/SaveToNewDashboard';
import { SaveToExistingDashboard } from './Forms/SaveToExistingDashboard';
import { SelectableValue } from '@grafana/data';

const ERRORS = {
  NAME_REQUIRED: 'Dashboard name is required.',
  NAME_EXISTS: 'A dashboard with the same name already exists in this folder.',
  INVALID_FIELD: 'This field is invalid.',
  UNKNOWN_ERROR: 'An unknown error occurred while saving the dashboard. Please try again.',
};

type SaveTarget = 'new_dashboard' | 'existing_dashboard';

const SAVE_TARGETS: Array<SelectableValue<SaveTarget>> = [
  {
    label: 'New Dashboard',
    value: 'new_dashboard',
  },
  {
    label: 'Existing Dashboard',
    value: 'existing_dashboard',
  },
];

function withRedirect<T extends any[]>(fn: (redirect: boolean, ...args: T) => {}, redirect: boolean) {
  return async (...args: T) => fn(redirect, ...args);
}

export interface ErrorResponse {
  status: string;
  message?: string;
}

type FormDTO = SaveToNewDashboardDTO | SaveToExistingDashboardDTO;

interface Props {
  onClose: () => void;
  onSave: (data: FormDTO, redirect: boolean) => Promise<void | ErrorResponse>;
}

export const AddToDashboardModal = ({ onClose, onSave }: Props) => {
  const [saveTarget, setSaveTarget] = useState<SaveTarget>(SAVE_TARGETS[0].value!);
  const [submissionError, setSubmissionError] = useState<string>();
  const methods = useForm<FormDTO>();
  const {
    handleSubmit,
    formState: { isSubmitting },
    setError,
  } = methods;

  const onSubmit = async (withRedirect: boolean, data: FormDTO) => {
    setSubmissionError(undefined);
    const error = await onSave(data, withRedirect);

    if (error) {
      switch (error.status) {
        case 'name-match':
          // error.message should always be defined here
          setError('dashboardName', { message: error.message ?? ERRORS.INVALID_FIELD });
          break;
        case 'empty-name':
          setError('dashboardName', { message: ERRORS.NAME_REQUIRED });
          break;
        case 'name-exists':
          setError('dashboardName', { message: ERRORS.NAME_EXISTS });
          break;
        default:
          setSubmissionError(error.message ?? ERRORS.UNKNOWN_ERROR);
      }
    }
  };

  return (
    <Modal title="Add panel to dashboard" onDismiss={onClose} isOpen>
      <RadioButtonGroup options={SAVE_TARGETS} value={saveTarget} onChange={(e) => setSaveTarget(e)} />

      <form>
        <FormProvider {...methods}>
          {saveTarget === 'new_dashboard' ? <SaveToNewDashboard /> : <SaveToExistingDashboard />}
        </FormProvider>

        {submissionError && (
          <Alert severity="error" title="Unknown error">
            {submissionError}
          </Alert>
        )}

        <Modal.ButtonRow>
          <Button type="reset" onClick={onClose} fill="outline" variant="secondary" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit(withRedirect(onSubmit, false))}
            variant="secondary"
            icon="compass"
            disabled={isSubmitting}
          >
            Save and keep exploring
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit(withRedirect(onSubmit, true))}
            variant="primary"
            icon="apps"
            disabled={isSubmitting}
          >
            Save and go to dashboard
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
};
