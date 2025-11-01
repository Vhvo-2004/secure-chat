import GroupList from './GroupList.jsx';
import ChatArea from './ChatArea.jsx';
import CryptoPanel from './CryptoPanel.jsx';

export default function ChatInterface() {
  return (
    <div className="chat-content">
      <GroupList />
      <ChatArea />
      <CryptoPanel />
    </div>
  );
}
