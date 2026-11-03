type InputKeyEvent = {
  key: string;
  nativeEvent: {
    isComposing?: boolean;
  };
  preventDefault: () => void;
};

export function runInputAdornmentAction(event: InputKeyEvent, action: () => void | Promise<void>, disabled = false) {
  if (event.key !== 'Enter' || event.nativeEvent.isComposing || disabled) {
    return;
  }

  event.preventDefault();
  void action();
}
