import { useUIStore } from '../../store';

export default function Toast() {
  const { toastMsg, toastVisible } = useUIStore();
  return (
    <div className={`toast${toastVisible ? ' show' : ''}`}>
      {toastMsg}
    </div>
  );
}
