import { MessageCreateParamsBase } from "@anthropic-ai/sdk/resources/messages";
import { get_encoding } from "tiktoken";
import { log } from "./log";

const enc = get_encoding("cl100k_base");

const getUseModel = (req: any, tokenCount: number, config: any) => {
  if (req.body.model.includes(",")) {
    return req.body.model;
  }
  // if tokenCount is greater than 60K, use the long context model
  if (tokenCount > 1000 * 60 && config.Router.longContext) {
    log("Using long context model due to token count:", tokenCount);
    return config.Router.longContext;
  }
  // If the model is claude-3-5-haiku, use the background model
  if (req.body.model?.startsWith("claude-3-5-haiku") && config.Router.background) {
    log("Using background model for ", req.body.model);
    return config.Router.background;
  }
  // if exits thinking, use the think model
  if (req.body.thinking && config.Router.think) {
    log("Using think model for ", req.body.thinking);
    return config.Router.think;
  }
  return config.Router!.default;
};

export const router = async (req: any, res: any, config: any) => {
  // Skip processing for Synapse API endpoints
  if (req.url && req.url.startsWith('/api/synapse/')) {
    console.log('Skipping router processing for Synapse API:', req.url);
    return;
  }
  
  if (!req.body) {
    console.log('No request body, skipping router');
    return;
  }
  
  console.log('Processing router for:', req.url);
  const { messages, system = [], tools }: MessageCreateParamsBase = req.body;
  
  // Check for Synapse context headers
  const hasSynapseContext = req.headers['x-synapse-project-id'] || 
                           req.headers['x-synapse-agent-id'] || 
                           req.headers['x-synapse-agent-type'];
  
  // If Synapse context is detected and enhanced routing is enabled, 
  // let the enhanced router handle the request
  if (hasSynapseContext && (req as any).synapseContext) {
    log("Synapse context detected, using enhanced routing");
    // Enhanced router will handle model selection
    return;
  }
  
  try {
    let tokenCount = 0;
    if (Array.isArray(messages)) {
      messages.forEach((message) => {
        if (typeof message.content === "string") {
          tokenCount += enc.encode(message.content).length;
        } else if (Array.isArray(message.content)) {
          message.content.forEach((contentPart) => {
            if (contentPart.type === "text") {
              tokenCount += enc.encode(contentPart.text).length;
            } else if (contentPart.type === "tool_use") {
              tokenCount += enc.encode(
                JSON.stringify(contentPart.input)
              ).length;
            } else if (contentPart.type === "tool_result") {
              tokenCount += enc.encode(
                typeof contentPart.content === "string"
                  ? contentPart.content
                  : JSON.stringify(contentPart.content)
              ).length;
            }
          });
        }
      });
    }
    if (typeof system === "string") {
      tokenCount += enc.encode(system).length;
    } else if (Array.isArray(system)) {
      system.forEach((item) => {
        if (item.type !== "text") return;
        if (typeof item.text === "string") {
          tokenCount += enc.encode(item.text).length;
        } else if (Array.isArray(item.text)) {
          item.text.forEach((textPart) => {
            tokenCount += enc.encode(textPart || "").length;
          });
        }
      });
    }
    if (tools) {
      tools.forEach((tool) => {
        if (tool.description) {
          tokenCount += enc.encode(tool.name + tool.description).length;
        }
        if (tool.input_schema) {
          tokenCount += enc.encode(JSON.stringify(tool.input_schema)).length;
        }
      });
    }
    const model = getUseModel(req, tokenCount, config);
    req.body.model = model;
  } catch (error: any) {
    log("Error in router middleware:", error.message);
    req.body.model = config.Router!.default;
  }
  return;
};
