import BrowserCompatibilityWarning from "./components/common/BrowserCompatibilityWarning";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./providers/AuthProvider";
import { QueryProvider } from "./providers/QueryProvider";
import AppRouter from "./router/AppRouter";

function App() {
  return (
    <QueryProvider>
      <BrowserCompatibilityWarning />
      <ErrorBoundary>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ErrorBoundary>
    </QueryProvider>
  );
}

export default App;
