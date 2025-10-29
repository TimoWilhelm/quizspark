import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { HomePage } from '@/pages/HomePage';
import { HostPage } from '@/pages/HostPage';
import { JoinPage } from '@/pages/JoinPage';
import { PlayerPage } from '@/pages/PlayerPage';
const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/host/:gameId",
    element: <HostPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/join",
    element: <JoinPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/play",
    element: <PlayerPage />,
    errorElement: <RouteErrorBoundary />,
  },
]);
export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}