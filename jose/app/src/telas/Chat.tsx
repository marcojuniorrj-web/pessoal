import { saudacao } from '@compartilhado/datas';
import { useUsuario } from '../estado/sessao';

export function Chat() {
  const usuario = useUsuario();
  return (
    <section className="tela chat-vazio">
      <h1 className="chat-vazio__saudacao">{saudacao(usuario.nome, new Date())}</h1>
    </section>
  );
}
