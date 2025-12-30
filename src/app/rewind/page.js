import RewindPage from '../../components/RewindPage';
import RewindWaitingPage from '../../components/RewindWaitingPage';

export default function Rewind() {
  const currentMonth = new Date().getMonth(); // 0 = January, 11 = December
  const isRewindActive = currentMonth === 11 || currentMonth === 0;

  return isRewindActive ? <RewindPage /> : <RewindWaitingPage />;
}
