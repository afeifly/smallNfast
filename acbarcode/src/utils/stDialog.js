import { ref } from 'vue';

export const dialogState = ref({
  visible: false,
  type: 'info', // 'info' | 'success' | 'warning' | 'danger' | 'confirm'
  title: '',
  message: '',
  confirmText: 'OK',
  cancelText: '',
  onConfirm: null,
  onCancel: null
});

export function showStAlert(message, title = 'Notice', type = 'info') {
  return new Promise((resolve) => {
    dialogState.value = {
      visible: true,
      type,
      title,
      message,
      confirmText: 'OK',
      cancelText: '',
      onConfirm: () => {
        dialogState.value.visible = false;
        resolve(true);
      },
      onCancel: () => {
        dialogState.value.visible = false;
        resolve(false);
      }
    };
  });
}

export function showStConfirm({
  title = 'Confirm Action',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'confirm'
}) {
  return new Promise((resolve) => {
    dialogState.value = {
      visible: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: () => {
        dialogState.value.visible = false;
        resolve(true);
      },
      onCancel: () => {
        dialogState.value.visible = false;
        resolve(false);
      }
    };
  });
}
