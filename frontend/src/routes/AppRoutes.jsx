import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import SecureChatPage from '../pages/SecureChatPage';
import GroupOverviewPage from '../pages/groups/GroupOverviewPage';
import GroupChatPage from '../pages/groups/GroupChatPage';
import GroupMembersPage from '../pages/groups/GroupMembersPage';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SecureChatPage />} />
        <Route path="/groups" element={<GroupOverviewPage />} />
        <Route path="/groups/:groupId/chat" element={<GroupChatPage />} />
        <Route path="/groups/:groupId/members" element={<GroupMembersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
