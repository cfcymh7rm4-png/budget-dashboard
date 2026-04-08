import React from 'react';

interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}

interface FormFieldProps {
  children: React.ReactNode;
  name: string;
}

interface FormItemProps {
  children: React.ReactNode;
  className?: string;
}

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

interface FormControlProps {
  children: React.ReactNode;
}

interface FormMessageProps {
  children?: React.ReactNode;
}

const FormContext = React.createContext<{
  error?: string;
}>({});

export const Form: React.FC<FormProps> = ({ children, ...props }) => {
  return <form {...props}>{children}</form>;
};

export const FormField: React.FC<FormFieldProps> = ({ children, name }) => {
  // 简化的表单字段，实际使用时应与 react-hook-form 集成
  return (
    <FormContext.Provider value={{}}>
      {children}
    </FormContext.Provider>
  );
};

export const FormItem: React.FC<FormItemProps> = ({ children, className = '' }) => {
  return <div className={`space-y-2 ${className}`}>{children}</div>;
};

export const FormLabel: React.FC<FormLabelProps> = ({ children, className = '', ...props }) => {
  return (
    <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>
      {children}
    </label>
  );
};

export const FormControl: React.FC<FormControlProps> = ({ children }) => {
  return <>{children}</>;
};

export const FormMessage: React.FC<FormMessageProps> = ({ children }) => {
  if (!children) return null;
  return <p className="text-sm text-red-500">{children}</p>;
};
