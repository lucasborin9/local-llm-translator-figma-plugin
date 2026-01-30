This plugin requires previous knowledge of Local LLM tools, please check [Ollama](https://docs.ollama.com/) or [LM Studio](lmstudio.ai/docs/app) documentation before using.

## One-click translate your Figma content using Local LLM Models.

You can use **LM Studio or Ollama** to connect Figma to your favorite Local LLM provider and provide one-click translation of your content.

### How it works:

- **Works with Figma and FigJam**
- Works with diverse forms of text nodes: common text nodes, post-its, text inside shapes, etc.
- **Preserves text formatting**, like maintaining bold highlights inside texts
- **Select what you want to translate, then select your provider, model and language and click Translate**
- It has a default prompt so it automatically translates **without the need of writing a prompt** every time you want to translate something
- Uses **Gemma2-9B as default model**, as it is lightweight and has the best default prompt adherence

**Don't forget to enable CORS in Ollama (`OLLAMA_ORIGINS=* ollama serve`) or [LM Studio](https://lmstudio.ai/docs/developer/core/server/settings), or the plugin will not work as Figma always passes the origin as null, which both APIs don't support.**

### How to load it in Figma:
Go to "Plugins > Development > Import plugin from manifest..." and select the manifest.json file.
