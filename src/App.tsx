import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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

function AppRoutes() {
  const { authStatus } = useAuth();

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={authStatus === 'authenticated' ? <Navigate to="/" replace /> : <Login />}
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ThemeProvider>
        <AuthProvider>
          <div className="app-container">
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </div>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
