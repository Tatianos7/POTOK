import React from 'react';
import {createRoot} from 'react-dom/client';
import AuthoringWeekViewer from './AuthoringWeekViewer';
import '../index.css';

// Separate local Vite entry: does not mount App/AuthProvider or import database clients.
createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthoringWeekViewer /></React.StrictMode>);
