import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthProvider } from './contexts/AuthContext';
import { SystemStatusProvider } from './contexts/SystemStatusContext';

function App() {
  return (
    <AuthProvider>
      <SystemStatusProvider>
        <RouterProvider router={router} />
      </SystemStatusProvider>
    </AuthProvider>
  );
}

export default App;
