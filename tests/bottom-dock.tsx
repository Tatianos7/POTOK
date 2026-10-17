import React from 'react';
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AppBottomDock from '../src/components/AppBottomDock';
import FoodDiary from '../src/pages/FoodDiary';
import FoodSearch from '../src/pages/FoodSearch';
import CreateCustomProductPage from '../src/pages/CreateCustomProductPage';
import CreateBrandProductPage from '../src/pages/CreateBrandProductPage';
import { uiRuntimeAdapter } from '../src/services/uiRuntimeAdapter';
import '../src/index.css';

// The real pages receive one synthetic diary. No auth provider or database is mounted.
uiRuntimeAdapter.getFoodDiaryState = async (_userId, date) => ({
  status: 'active',
  syncStatus: 'synced',
  meals: { date, breakfast: [], lunch: [], dinner: [], snack: [], water: 0 },
});

export function Fixture() {
  const location = useLocation();
  return (
    <AppBottomDock showNavigation hasPremiumAccess={false}>
      <div data-test-route-links className="flex gap-2 px-2">
        <Link to="/nutrition">diary</Link>
        <Link to="/nutrition/search">search</Link>
        <Link to="/nutrition/create-custom-product">custom</Link>
        <Link to="/nutrition/create-brand-product">brand</Link>
      </div>
      <output data-path className="sr-only">{location.pathname}</output>
      <Routes>
        <Route path="/nutrition" element={<FoodDiary />} />
        <Route path="/nutrition/search" element={<FoodSearch />} />
        <Route path="/nutrition/create-custom-product" element={<CreateCustomProductPage />} />
        <Route path="/nutrition/create-brand-product" element={<CreateBrandProductPage />} />
        <Route path="/profile" element={<div>Синтетическая страница профиля</div>} />
      </Routes>
    </AppBottomDock>
  );
}

createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/nutrition']}><Fixture /></MemoryRouter>);
