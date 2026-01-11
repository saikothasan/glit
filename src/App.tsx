import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { CopyIcon, GlobeIcon, RefreshCcwIcon } from 'lucide-react';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import { Loader } from '@/components/ai-elements/loader';
import './App.css';

const ChatBot = () => {
  const [input, setInput] = useState('');
  // We don't really support model switching yet in backend, but UI can show it
  const [webSearch, setWebSearch] = useState(false);

  const { messages, sendMessage, status, reload, stop } = useChat({
    api: '/api/chat',
    // Transform custom data events into message parts if needed,
    // but useChat handles standard protocol.
    // Our backend sends 'd' (data) for reasoning.
    // We might need to process data parts in the UI.
  });

  const handleSubmit = () => {
    if (!input.trim()) return;

    sendMessage(
      {
        content: input,
        role: 'user'
      },
      {
        body: {
          webSearch: webSearch,
        },
      },
    );
    setInput('');
  };

  // Helper to extract reasoning from data parts
  const getReasoning = (message: any) => {
    // If we sent data parts with { type: 'reasoning', content: ... }
    // useChat stores them in message.toolInvocations or message.data?
    // In SDK 3.x/4.x/5.x it varies. SDK 6 (beta) has specialized parts.
    // If we use '0' text parts, it's just text.
    // If we use '2' (tool), it's tool.
    // If we use 'd' (data), it's in message.data (array).
    if (message.data) {
        return message.data
            .filter((d: any) => d && d.type === 'reasoning')
            .map((d: any) => d.content)
            .join('\n');
    }
    return null;
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground">
      <div className="flex-1 overflow-hidden relative max-w-4xl mx-auto w-full p-4">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => {
              const reasoning = getReasoning(message);
              return (
              <div key={message.id} className="mb-6">

                {/* Reasoning Block */}
                {reasoning && (
                   <Reasoning className="mb-2 w-full">
                      <ReasoningTrigger />
                      <ReasoningContent>{reasoning}</ReasoningContent>
                   </Reasoning>
                )}

                {/* Message Content */}
                <Message from={message.role}>
                  <MessageContent>
                    <MessageResponse>
                        {/* We render standard text content */}
                        {message.content}
                    </MessageResponse>
                  </MessageContent>

                  {message.role === 'assistant' && (
                    <MessageActions>
                      <MessageAction
                        onClick={() => reload()}
                        label="Retry"
                      >
                        <RefreshCcwIcon className="size-3" />
                      </MessageAction>
                      <MessageAction
                        onClick={() =>
                          navigator.clipboard.writeText(message.content)
                        }
                        label="Copy"
                      >
                        <CopyIcon className="size-3" />
                      </MessageAction>
                    </MessageActions>
                  )}
                </Message>
              </div>
            )})}

            {status === 'submitted' && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      <div className="p-4 bg-background/80 backdrop-blur-sm border-t">
        <PromptInput onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <PromptInputHeader />
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              placeholder="Ask Polymath to research or code..."
              onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                 }
              }}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputButton
                variant={webSearch ? 'default' : 'ghost'}
                onClick={() => setWebSearch(!webSearch)}
                className={webSearch ? "text-blue-500" : ""}
              >
                <GlobeIcon size={16} />
                <span className="ml-2">Deep Research</span>
              </PromptInputButton>
            </PromptInputTools>
            <PromptInputSubmit disabled={!input.trim() && status !== 'streaming'} status={status === 'streaming' ? 'streaming' : 'ready'} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

export default ChatBot;
