import { createFileRoute } from "@tanstack/react-router";
import payload from "../../../../grupo adicional incêndio florestal e incêndio em vegetação (1).json";

export const Route = createFileRoute("/api/public/grupo-adicional-incendio")({
  server: {
    handlers: {
      GET: () => {
        return Response.json(payload, {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
