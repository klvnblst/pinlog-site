# pinlog.life

Site público do PinLog, publicado pelo GitHub Pages em **https://pinlog.life**.

## Como editar um texto (sem programar)

1. Abra o arquivo da página aqui no GitHub:
   - Política de Privacidade → `privacidade.md`
   - Termos de Uso → `termos.md`
   - Excluir conta → `excluir-conta.md`
   - Suporte → `suporte.md`
   - Página inicial → `index.html` (tem mais código; peça ajuda se for mudar a estrutura)
2. Clique no **lápis (✏️)** no canto superior direito do arquivo.
3. Altere o texto. Para formatar:
   - `## Título` cria um título de seção
   - `**texto**` deixa em **negrito**
   - linhas começando com `- ` viram lista
   - `[texto do link](https://endereco)` cria um link
4. Clique em **Commit changes** (e de novo em **Commit changes** na janela).
5. Em cerca de 1 minuto o site está atualizado. Se algo der errado, a aba **Actions** mostra o erro, e o histórico do arquivo permite voltar à versão anterior.

## Atenção ao mudar a política ou os termos

- Atualize a linha `updated:` no topo do arquivo (data e versão).
- Mudança relevante na política ou nos termos precisa de novo aceite no app: avise o desenvolvimento para atualizar `LEGAL_VERSION` em `mobile/src/lib/legal.ts` com a mesma data.
- O texto de referência também está em `docs/publicacao/publico/TEXTOS-PARA-PUBLICAR.md`, no repositório do app. Mantenha os dois iguais.

## Quando o app chegar às lojas

Em `_config.yml`, preencha `app_store` e `google_play` com os links. Os botões da página inicial deixam de dizer "Em breve" sozinhos.

## Regras de conteúdo

- Não cite nomes de medicamentos ou tratamentos específicos.
- O PinLog é um organizador pessoal: nada de orientação médica, prescrição ou promessa clínica.
- O site não usa cookies, rastreadores nem fontes ou scripts de terceiros. Mantenha assim, para continuar coerente com a política.
