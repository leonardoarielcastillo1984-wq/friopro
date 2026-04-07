'use client';

import * as React from 'react';

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(value);

    return (
      <div
        ref={ref}
        role="radiogroup"
        className={`flex flex-col gap-2 ${className}`}
        {...props}
      >
        {React.Children.map(props.children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              checked: internalValue === (child as any).props.value,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                setInternalValue(e.target.value);
                onValueChange?.(e.target.value);
              },
            });
          }
          return child;
        })}
      </div>
    );
  }
);
RadioGroup.displayName = 'RadioGroup';

interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, ...props }, ref) => (
    <input
      ref={ref}
      type="radio"
      value={value}
      className={`h-4 w-4 cursor-pointer ${className}`}
      {...props}
    />
  )
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
