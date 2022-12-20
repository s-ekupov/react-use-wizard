import * as React from 'react';

import * as logger from './logger';
import { Handler, HashKeys, WizardProps } from './types';
import WizardContext from './wizardContext';

const Wizard: React.FC<React.PropsWithChildren<WizardProps>> = React.memo(
  ({
    header,
    footer,
    children,
    wrapper: Wrapper,
    startIndex = 0,
    hashEnabled = false,
  }) => {
    const hashKeys: HashKeys = { hashes: {}, steps: {} };
    let initialStep = startIndex;

    const updateHash = (stepNumber: number) => {
      window.location.hash = hashKeys.steps[stepNumber];
    };

    if (hashEnabled) {
      React.Children.toArray(children).forEach((child: React.ReactNode, i) => {
        const hashKey: string =
          (child as React.ReactElement).props.hashKey || `step${i + 1}`;
        hashKeys.steps[i] = hashKey;
        hashKeys.hashes[hashKey] = i;
      });

      const hash = decodeURI(window.location.hash).replace(/^#/, '');
      initialStep = hashKeys.hashes[hash] || startIndex;
      updateHash(initialStep);
    }

    const [activeStep, setActiveStep] = React.useState(initialStep);
    const [isLoading, setIsLoading] = React.useState(false);
    const hasNextStep = React.useRef(true);
    const hasPreviousStep = React.useRef(false);
    const nextStepHandler = React.useRef<Handler>(() => {});
    const stepCount = React.Children.toArray(children).length;

    hasNextStep.current = activeStep < stepCount - 1;
    hasPreviousStep.current = activeStep > 0;

    const goToNextStep = React.useRef(() => {
      if (hasNextStep.current) {
        setActiveStep((activeStep) => activeStep + 1);
        if (hashEnabled) {
          updateHash(activeStep + 1);
        }
      }
    });

    const goToPreviousStep = React.useRef(() => {
      if (hasPreviousStep.current) {
        nextStepHandler.current = null;
        setActiveStep((activeStep) => activeStep - 1);
        if (hashEnabled) {
          updateHash(activeStep - 1);
        }
      }
    });

    const goToStep = React.useRef((stepIndex: number) => {
      if (stepIndex >= 0 && stepIndex < stepCount) {
        nextStepHandler.current = null;
        setActiveStep(stepIndex);
        if (hashEnabled) {
          updateHash(stepIndex);
        }
      } else {
        if (__DEV__) {
          logger.log(
            'warn',
            [
              `Invalid step index [${stepIndex}] passed to 'goToStep'. `,
              `Ensure the given stepIndex is not out of boundaries.`,
            ].join(''),
          );
        }
      }
    });

    // Callback to attach the step handler
    const handleStep = React.useRef((handler: Handler) => {
      nextStepHandler.current = handler;
    });

    const doNextStep = React.useRef(async () => {
      if (hasNextStep.current && nextStepHandler.current) {
        try {
          setIsLoading(true);
          await nextStepHandler.current();
          setIsLoading(false);
          nextStepHandler.current = null;
          goToNextStep.current();
        } catch (error) {
          setIsLoading(false);
          throw error;
        }
      } else {
        goToNextStep.current();
      }
    });

    const wizardValue = React.useMemo(
      () => ({
        nextStep: doNextStep.current,
        previousStep: goToPreviousStep.current,
        handleStep: handleStep.current,
        isLoading,
        activeStep,
        stepCount,
        isFirstStep: !hasPreviousStep.current,
        isLastStep: !hasNextStep.current,
        goToStep: goToStep.current,
        hashKeys,
      }),
      [activeStep, stepCount, isLoading, hashKeys],
    );

    const activeStepContent = React.useMemo(() => {
      const reactChildren = React.Children.toArray(children);

      if (__DEV__) {
        // No steps passed
        if (reactChildren.length === 0) {
          logger.log(
            'warn',
            'Make sure to pass your steps as children in your <Wizard>',
          );
        }
        // The passed start index is invalid
        if (activeStep > reactChildren.length) {
          logger.log('warn', 'An invalid startIndex is passed to <Wizard>');
        }
        // Invalid header element
        if (header && !React.isValidElement(header)) {
          logger.log('error', 'Invalid header passed to <Wizard>');
        }
        // Invalid footer element
        if (footer && !React.isValidElement(footer)) {
          logger.log('error', 'Invalid footer passed to <Wizard>');
        }
      }

      return reactChildren[activeStep];
    }, [activeStep, children, header, footer]);

    const enhancedActiveStepContent = React.useMemo(
      () =>
        Wrapper
          ? React.cloneElement(Wrapper, { children: activeStepContent })
          : activeStepContent,
      [Wrapper, activeStepContent],
    );

    React.useEffect(() => {
      const onHashChange = () => {
        const hash = decodeURI(window.location.hash).replace(/^#/, '');
        const hashStep = hashKeys.hashes[hash];
        if (hashStep !== undefined) {
          goToStep.current(hashKeys.hashes[hash]);
        }
      };

      if (hashEnabled) {
        window.addEventListener('hashchange', onHashChange);
      }

      return () => {
        window.removeEventListener('hashchange', onHashChange);
      };
    }, [hashEnabled, hashKeys.hashes]);

    return (
      <WizardContext.Provider value={wizardValue}>
        {header}
        {enhancedActiveStepContent}
        {footer}
      </WizardContext.Provider>
    );
  },
);

export default Wizard;
