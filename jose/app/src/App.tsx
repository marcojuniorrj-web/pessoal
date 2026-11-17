import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RotaProtegida } from './componentes/RotaProtegida';
import { ToastProvider } from './componentes/Toast';
import { SessaoProvider } from './estado/sessao';
import { Ajustes } from './telas/Ajustes';
import { Chat } from './telas/Chat';
import { JoseSabe } from './telas/JoseSabe';
import { Login } from './telas/Login';
import { TesteVoz } from './telas/TesteVoz';
import { Tarefas } from './telas/Tarefas';

export function App() {
  return (
    <BrowserRouter>
      <SessaoProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RotaProtegida />}>
              <Route index element={<Chat />} />
              <Route path="tarefas" element={<Tarefas />} />
              <Route path="jose-sabe" element={<JoseSabe />} />
              <Route path="ajustes" element={<Ajustes />} />
              <Route path="teste-voz" element={<TesteVoz />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </SessaoProvider>
    </BrowserRouter>
  );
}
