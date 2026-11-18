import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './estilo/global.css';
import { App } from './App';
import { capturarPromptInstalacao } from './estado/instalar';

// Guarda o convite de instalação do navegador (Android e computador) para o botão "Instalar".
capturarPromptInstalacao();

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
