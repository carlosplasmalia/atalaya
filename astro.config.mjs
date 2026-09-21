import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  site: "https://atalaya.netlify.app",
  integrations: [tailwind()],
  output: "static",
  build: {
    inlineStylesheets: "auto",
  },
});
