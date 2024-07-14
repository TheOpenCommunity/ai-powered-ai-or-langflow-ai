const OPENAI_API_KEY = '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export const getCompletion = async (messages: any[]): Promise<string> => {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
            role: 'system',
            content: `You are a helpful assistant that helps to create and connect components for a flow. The available components are ChatInput, ChatOutput, and OpenAIModel. Each component has specific JSON templates that need to be added to the flow and connected with edges. Given a user prompt, return a structured JSON response indicating which nodes to add and how to connect them. The expected response format is:
            {
                "nodes": [
                {
                    "type": "ChatInput",
                    "id": "ChatInput-Qw"
                },
                {
                    "type": "OpenAIModel",
                    "id": "OpenAIModel-Qa"
                },
                {
                    "type": "ChatOutput",
                    "id": "ChatOutput-QA"
                }
                ],
                "edges": [
                {
                    "source": "ChatInput-Qw",
                    "target": "OpenAIModel-Qa"
                },
                {
                    "source": "OpenAIModel-Qa",
                    "target": "ChatOutput-QA"
                }
                ]
            } . \n  REMEMBER: You should only return json with nodes and edges.`
        },
        ...messages
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch completion: ${response.statusText}`);
  }

  const data = await response.json();
  let completion = data.choices[0].message.content;

  // Debug
  console.log('---------response from gpt4o---------');
  console.log(data);

    // Remove code block delimiters if present
    completion = completion.replace(/```json/g, '').replace(/```/g, '').trim();

  return completion;
};
