import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import '@/index.css'
import { HomePage } from '@/pages/HomePage'
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
// Do not touch this code
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
)