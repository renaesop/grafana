import React from 'react';
import { Field, InputControl } from '@grafana/ui';
import { useFormContext } from 'react-hook-form';
import { SaveToExistingDashboardDTO } from '../addToDashboard';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';

export interface ErrorResponse {
  status: string;
  message?: string;
}

const ERRORS = {
  INVALID_DASHBOARD: 'Select a valid dashboard to save your panel in.',
};

export const SaveToExistingDashboard = () => {
  const {
    formState: { errors },
    control,
  } = useFormContext<SaveToExistingDashboardDTO>();

  return (
    <>
      <p>Add a panel with the explored queries to an existing dashboard.</p>

      <InputControl
        render={({ field: { ref, value, ...field } }, ...others) => (
          <Field
            label="Dashboard"
            description="Select in which dashboard the panel will be created."
            // @ts-expect-error this is because of a limitiation with react-hook-form using objects
            // as values where errors can only be mapped to leaf properties.
            error={errors.dashboard?.message}
            invalid={!!errors.dashboard}
          >
            <DashboardPicker {...field} value={value?.uid} {...others} inputId="dashboard" defaultOptions />
          </Field>
        )}
        control={control}
        name="dashboard"
        shouldUnregister
        rules={{ required: { value: true, message: ERRORS.INVALID_DASHBOARD } }}
      />
    </>
  );
};
