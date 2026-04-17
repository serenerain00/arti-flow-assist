import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { ConversationProvider } from "@elevenlabs/react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SmartWall" },
      {
        name: "description",
        content:
          "Arti Wall is a smart OR monitor that guides surgical teams pre-case, intra-case, and post-case.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "SmartWall" },
      {
        property: "og:description",
        content:
          "Arti Wall is a smart OR monitor that guides surgical teams pre-case, intra-case, and post-case.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "SmartWall" },
      {
        name: "twitter:description",
        content:
          "Arti Wall is a smart OR monitor that guides surgical teams pre-case, intra-case, and post-case.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1ffd6abe-6576-4d8d-bfbb-a04b36be0f3f/id-preview-aaf544b0--da1c374f-1d6b-4253-ac96-f94eaedefd02.lovable.app-1776441995519.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1ffd6abe-6576-4d8d-bfbb-a04b36be0f3f/id-preview-aaf544b0--da1c374f-1d6b-4253-ac96-f94eaedefd02.lovable.app-1776441995519.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  // ConversationProvider is required by @elevenlabs/react's useConversation
  // hook. Mounted at the root so any component (e.g. ArtiInvoker) can
  // start/stop a voice session.
  return (
    <ConversationProvider>
      <Outlet />
    </ConversationProvider>
  );
}
