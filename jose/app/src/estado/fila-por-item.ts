// Serializa as chamadas de um mesmo item: "concluir" e logo "Desfazer" chegam ao servidor na ordem em que foram tocados.
export function criarFilaPorItem() {
  const filas = new Map<string, Promise<unknown>>();
  return function enfileirar<T>(id: string, tarefa: () => Promise<T>): Promise<T> {
    const anterior = filas.get(id) ?? Promise.resolve();
    const proxima = anterior.catch(() => undefined).then(tarefa);
    filas.set(id, proxima);
    // Não deixa o mapa crescer: quando a última da fila termina, ela sai.
    void proxima.catch(() => undefined).finally(() => {
      if (filas.get(id) === proxima) filas.delete(id);
    });
    return proxima;
  };
}
