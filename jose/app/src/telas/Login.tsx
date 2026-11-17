export function Login() {
  return (
    <section className="tela">
      <h1 className="tela__titulo">José</h1>
      <a className="botao botao--principal" href={`/auth/google${new URLSearchParams(location.search).get("voltar") ? `?voltar=${encodeURIComponent(new URLSearchParams(location.search).get("voltar")!)}` : ""}`}>Entrar com Google</a>
    </section>
  );
}
