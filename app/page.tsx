export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <main className="mx-6 my-12 max-w-2xl text-center">
        <h1 className="mb-4 text-4xl font-bold">3Professores — Frontend (placeholder)</h1>
        <p className="mb-6 text-lg text-gray-700">
          Esta é uma versão mínima do front-end para que o restante do time implemente as telas.
          Faça alterações em <code>app/</code> e abra PRs para revisão.
        </p>
        <div className="space-y-3 text-left">
          <p className="font-medium">Tarefas sugeridas:</p>
          <ul className="list-disc pl-6 text-gray-700">
            <li>Implementar layout e header</li>
            <li>Criar páginas: Home, Sobre, Contato</li>
            <li>Componentizar: Header, Footer, Card, Form</li>
            <li>Adicionar roteamento e testes básicos</li>
          </ul>
        </div>
        <p className="mt-6 text-sm text-gray-600">
          Repo: <a href="https://github.com/VictorErbs/3professores">github.com/VictorErbs/3professores</a>
        </p>
      </main>
    </div>
  );
}
