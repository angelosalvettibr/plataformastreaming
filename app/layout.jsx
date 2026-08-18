import "./globals.css";

export const metadata = {
  title: "Angelo's Life Companion",
  description: "Il libro di bordo — cockpit, caixa e mesa do grupo Salvetti",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Archivo:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
