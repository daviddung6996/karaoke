import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import TVWindow from './TVWindow';
import './styles/globals.css';

const isTVWindow = window.location.pathname === '/tv';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        {isTVWindow ? <TVWindow /> : <App />}
    </StrictMode>
);
