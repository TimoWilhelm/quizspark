import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { HomePage } from '@/pages/HomePage';
import { HostPage } from '@/pages/HostPage';
import { PlayerPage } from '@/pages/PlayerPage';
import { QuizEditorPage } from '@/pages/QuizEditorPage';
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
    path: "/play",
    element: <PlayerPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/edit/:quizId?",
    element: <QuizEditorPage />,
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