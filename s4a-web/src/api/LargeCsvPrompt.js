let resolveChoice = null;

export function promptLargeCsvChoice(file) {
  return new Promise(resolve => {
    resolveChoice = resolve;
    window.dispatchEvent(new CustomEvent('largeCsvDetected', {
      detail: {
        filename: file.name,
        sizeMB: (file.size / 1024 / 1024).toFixed(1),
        sizeGB: (file.size / 1024 / 1024 / 1024).toFixed(2)
      }
    }));
  });
}

export function resolveLargeCsvChoice(choice) {
  if (resolveChoice) {
    resolveChoice(choice);
    resolveChoice = null;
  }
}
