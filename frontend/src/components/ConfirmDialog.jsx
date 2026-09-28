import Modal from './Modal';

export default function ConfirmDialog({ open, title = 'Are you sure?', message, onConfirm, onCancel, confirmLabel = 'Confirm', danger }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
