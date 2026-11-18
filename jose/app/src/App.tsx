import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RotaProtegida } from './componentes/RotaProtegida';
import { ToastProvider } from './componentes/Toast';
import { SessaoProvider } from './estado/sessao';
import { Ajustes } from './telas/Ajustes';
import { BoasVindas } from './telas/BoasVindas';
import { Inicio } from './telas/Inicio';
import { JoseSabe } from './telas/JoseSabe';
import { Login } from './telas/Login';
import { Tarefas } from './telas/Tarefas';

export function App() {
  return (
    <BrowserRouter>
      <SessaoProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RotaProtegida />}>
              <Route index element={<Inicio />} />
              <Route path="tarefas" element={<Tarefas />} />
              <Route path="jose-sabe" element={<JoseSabe />} />
              <Route path="ajustes" element={<Ajustes />} />
            </Route>
            <Route element={<RotaProtegida semAbas />}>
              <Route path="boas-vindas" element={<BoasVindas />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </SessaoProvider>
    </BrowserRouter>
  );
}
