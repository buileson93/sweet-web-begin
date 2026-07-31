import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hello World" },
      {
        name: "description",
        content: "Một giao diện HTML CSS cơ bản với Hello World.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-7xl">
        Hello World
      </h1>
      <p className="mt-4 text-base text-muted-foreground sm:text-lg">
        Chào bạn — đây là giao diện cơ bản bằng HTML & CSS.
      </p>
    </div>
  );
}
