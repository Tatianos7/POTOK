import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import CoachHistory from './pages/CoachHistory';
import ForgotPassword from './pages/ForgotPassword';
import AdminPanel from './pages/AdminPanel';
import Notifications from './pages/Notifications';
import Goal from './pages/Goal';
import GoalResult from './pages/GoalResult';
import Measurements from './pages/Measurements';
import FoodDiary from './pages/FoodDiary';
import FoodSearch from './pages/FoodSearch';
import FavoritesProductsPage from './pages/FavoritesProductsPage';
import RecipeAnalyzer from './pages/RecipeAnalyzer';
import Recipes from './pages/Recipes';
import RecipeDetails from './pages/RecipeDetails';
import CreateCustomProductPage from './pages/CreateCustomProductPage';
import CreateBrandProductPage from './pages/CreateBrandProductPage';
import Habits from './pages/Habits';
import Workouts from './pages/Workouts';
import Progress from './pages/Progress';
import ImportExercises from './pages/ImportExercises';
import PoseCoach from './pages/PoseCoach';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Today from './pages/Today';
import MyProgram from './pages/MyProgram';
import Paywall from './pages/Paywall';
import AuthCallback from './pages/AuthCallback';
import PinSetup from './pages/PinSetup';
import PinUnlock from './pages/PinUnlock';
import PinOffer from './pages/PinOffer';
import { getPostLoginRoute, isPinLockEnabled, isPinOfferSkipped, isPinSessionUnlocked } from './services/pinLockService';

function AppRoutes() {
  const { authStatus } = useAuth();
  const location = useLocation();

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  const pinEnabled = isPinLockEnabled();
  const pinUnlocked = isPinSessionUnlocked();
  const isPinUnlockRoute = location.pathname === '/pin/unlock';
  const isPinOfferRoute = location.pathname === '/pin/offer';
  const isPinSetupRoute = location.pathname === '/pin/setup';
  const isAuthCallbackRoute = location.pathname === '/auth/callback';
  const shouldShowPinOffer = !pinEnabled && !isPinOfferSkipped();

  if (authStatus === 'authenticated' && pinEnabled && !pinUnlocked && !isPinUnlockRoute) {
    return <Navigate to="/pin/unlock" replace />;
  }

  if (
    authStatus === 'authenticated' &&
    shouldShowPinOffer &&
    !isPinOfferRoute &&
    !isPinSetupRoute &&
    !isAuthCallbackRoute
  ) {
    return <Navigate to={getPostLoginRoute()} replace />;
  }

  return (
    <Routes>
      <Route
        path="/auth"
        element={authStatus === 'authenticated' ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/auth/callback"
        element={<AuthCallback />}
      />
      <Route
        path="/pin/unlock"
        element={<PinUnlock />}
      />
      <Route
        path="/pin/offer"
        element={
          <ProtectedRoute>
            <PinOffer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/login"
        element={<Navigate to="/auth" replace />}
      />
      <Route
        path="/register"
        element={authStatus === 'authenticated' ? <Navigate to="/" replace /> : <Register />}
      />
      <Route
        path="/forgot-password"
        element={authStatus === 'authenticated' ? <Navigate to="/" replace /> : <ForgotPassword />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/edit"
        element={
          <ProtectedRoute>
            <EditProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coach-history"
        element={
          <ProtectedRoute>
            <CoachHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPanel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/goals"
        element={
          <ProtectedRoute>
            <Goal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/goal"
        element={
          <ProtectedRoute>
            <Goal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/goal/result"
        element={
          <ProtectedRoute>
            <GoalResult />
          </ProtectedRoute>
        }
      />
      <Route
        path="/measurements"
        element={
          <ProtectedRoute>
            <Measurements />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nutrition"
        element={
          <ProtectedRoute>
            <FoodDiary />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nutrition/search"
        element={
          <ProtectedRoute>
            <FoodSearch />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nutrition/recipe-analyzer"
        element={
          <ProtectedRoute>
            <RecipeAnalyzer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nutrition/create-custom-product"
        element={
          <ProtectedRoute>
            <CreateCustomProductPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nutrition/create-brand-product"
        element={
          <ProtectedRoute>
            <CreateBrandProductPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nutrition/recipes"
        element={
          <ProtectedRoute>
            <Recipes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nutrition/recipes/:id"
        element={
          <ProtectedRoute>
            <RecipeDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nutrition/favorites"
        element={
          <ProtectedRoute>
            <FavoritesProductsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/habits"
        element={
          <ProtectedRoute>
            <Habits />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workouts"
        element={
          <ProtectedRoute>
            <Workouts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/progress"
        element={
          <ProtectedRoute>
            <Progress />
          </ProtectedRoute>
        }
      />
      <Route
        path="/today"
        element={
          <ProtectedRoute>
            <Today />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-program"
        element={
          <ProtectedRoute>
            <MyProgram />
          </ProtectedRoute>
        }
      />
      <Route
        path="/paywall"
        element={
          <ProtectedRoute>
            <Paywall />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pose"
        element={
          <ProtectedRoute>
            <PoseCoach />
          </ProtectedRoute>
        }
      />
      <Route
        path="/import-exercises"
        element={
          <ProtectedRoute>
            <ImportExercises />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pin/setup"
        element={
          <ProtectedRoute>
            <PinSetup />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router
      basename={import.meta.env.BASE_URL}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <div className="app-container">
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </div>
    </Router>
  );
}

export default App;
