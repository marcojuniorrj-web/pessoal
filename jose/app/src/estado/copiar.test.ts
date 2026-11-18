// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copiarTexto } from './copiar';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (document as { execCommand?: unknown }).execCommand;
});

describe('copiarTexto', () => {
  it('usa navigator.clipboard quando existe', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copiarTexto('olá')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('olá');
  });

  describe('plano B (sem navigator.clipboard)', () => {
    function montar(resultado = true) {
      vi.stubGlobal('navigator', {});
      const visto: { readOnly?: boolean; editable?: string; selecao?: [number | null, number | null]; foco?: boolean; texto?: string; estilo?: string; naPagina?: boolean } = {};
      (document as { execCommand?: unknown }).execCommand = vi.fn((cmd: string) => {
        const campo = document.activeElement as HTMLTextAreaElement;
        Object.assign(visto, {
          readOnly: campo.readOnly, editable: campo.contentEditable, selecao: [campo.selectionStart, campo.selectionEnd],
          foco: campo.tagName === 'TEXTAREA', texto: campo.value, estilo: campo.style.cssText, naPagina: campo.isConnected,
        });
        return cmd === 'copy' && resultado;
      });
      return visto;
    }

    it('seleciona o texto inteiro (select + setSelectionRange) num campo somente leitura, fora da vista e sem rolar', async () => {
      const visto = montar();
      const setSel = vi.spyOn(HTMLTextAreaElement.prototype, 'setSelectionRange');
      const foco = vi.spyOn(HTMLElement.prototype, 'focus');
      const texto = 'Bom dia, Marco.\nPróximo passo: abrir o arquivo.';
      expect(await copiarTexto(texto)).toBe(true);
      expect(setSel).toHaveBeenCalledWith(0, texto.length);
      expect(foco).toHaveBeenCalledWith({ preventScroll: true });
      expect(visto).toMatchObject({ readOnly: true, editable: 'false', selecao: [0, texto.length], foco: true, texto, naPagina: true });
      expect(visto.estilo).toMatch(/position:\s*fixed/);
      expect(visto.estilo).toMatch(/opacity:\s*0/);
      expect(visto.estilo).toMatch(/font-size:\s*16px/);
      expect(document.querySelectorAll('textarea')).toHaveLength(0); // o campo temporário é removido
    });

    it('devolve false quando o navegador recusa copiar, e devolve o foco a quem o tinha', async () => {
      montar(false);
      const botao = document.createElement('button');
      document.body.appendChild(botao);
      botao.focus();
      expect(await copiarTexto('x')).toBe(false);
      expect(document.activeElement).toBe(botao);
      botao.remove();
    });

    it('devolve false se o execCommand lançar erro', async () => {
      vi.stubGlobal('navigator', {});
      (document as { execCommand?: unknown }).execCommand = () => {
        throw new Error('bloqueado');
      };
      expect(await copiarTexto('x')).toBe(false);
      expect(document.querySelectorAll('textarea')).toHaveLength(0);
    });

    it('se navigator.clipboard recusar, cai no plano B', async () => {
      vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('negado')) } });
      const exec = vi.fn(() => true);
      (document as { execCommand?: unknown }).execCommand = exec;
      expect(await copiarTexto('x')).toBe(true);
      expect(exec).toHaveBeenCalledWith('copy');
    });
  });
});
