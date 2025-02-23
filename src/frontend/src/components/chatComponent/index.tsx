import { Transition } from "@headlessui/react";
import { useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import IOModal from "../../modals/IOModal";
import ApiModal from "../../modals/apiModal";
import ShareModal from "../../modals/shareModal";
import useFlowStore from "../../stores/flowStore";
import useFlowsManagerStore from "../../stores/flowsManagerStore";
import { useShortcutsStore } from "../../stores/shortcuts";
import { useStoreStore } from "../../stores/storeStore";
import { classNames, isThereModal } from "../../utils/utils";
import ForwardedIconComponent from "../genericIconComponent";
import { Separator } from "../ui/separator";
import { getCompletion } from './gptService';
import { addNodesToFlow, addEdgeToFlow, saveFullFlow } from './flowUtils';
import chatinputTemplate from './chatinput.json';
import chatoutputTemplate from './chatoutput.json';
import modelTemplate from './model.json';
import fullFlowTemplate from './fullflow.json';

export default function FlowToolbar(): JSX.Element {
  const preventDefault = true;
  const [open, setOpen] = useState<boolean>(false);
  const [openCodeModal, setOpenCodeModal] = useState<boolean>(false);
  const [openShareModal, setOpenShareModal] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  function handleAPIWShortcut(e: KeyboardEvent) {
    if (isThereModal() && !openCodeModal) return;
    setOpenCodeModal((oldOpen) => !oldOpen);
  }

  function handleChatWShortcut(e: KeyboardEvent) {
    if (isThereModal() && !open) return;
    if (useFlowStore.getState().hasIO) {
      setOpen((oldState) => !oldState);
    }
  }

  function handleShareWShortcut(e: KeyboardEvent) {
    if (isThereModal() && !openShareModal) return;
    setOpenShareModal((oldState) => !oldState);
  }

  const openPlayground = useShortcutsStore((state) => state.open);
  const api = useShortcutsStore((state) => state.api);
  const flow = useShortcutsStore((state) => state.flow);

  useHotkeys(openPlayground, handleChatWShortcut, { preventDefault });
  useHotkeys(api, handleAPIWShortcut, { preventDefault });
  useHotkeys(flow, handleShareWShortcut, { preventDefault });

  const hasIO = useFlowStore((state) => state.hasIO);
  const hasStore = useStoreStore((state) => state.hasStore);
  const validApiKey = useStoreStore((state) => state.validApiKey);
  const hasApiKey = useStoreStore((state) => state.hasApiKey);
  const currentFlow = useFlowsManagerStore((state) => state.currentFlow);
  const mergeFlow = useFlowsManagerStore((state) => state.mergeFlow);
  const setCurrentFlow = useFlowsManagerStore((state) => state.setCurrentFlow);

  const prevNodesRef = useRef<any[] | undefined>();

  const ModalMemo = useMemo(
    () => (
      <ShareModal
        is_component={false}
        component={currentFlow!}
        disabled={!hasApiKey || !validApiKey || !hasStore}
        open={openShareModal}
        setOpen={setOpenShareModal}
      >
        <button
          disabled={!hasApiKey || !validApiKey || !hasStore}
          className={classNames(
            "relative inline-flex h-full w-full items-center justify-center gap-[4px] bg-muted px-5 py-3 text-sm font-semibold text-foreground transition-all duration-150 ease-in-out hover:bg-background hover:bg-hover",
            !hasApiKey || !validApiKey || !hasStore
              ? "button-disable text-muted-foreground"
              : "",
          )}
          data-testid="shared-button-flow"
        >
          <ForwardedIconComponent
            name="Share3"
            className={classNames(
              "-m-0.5 -ml-1 h-6 w-6",
              !hasApiKey || !validApiKey || !hasStore
                ? "extra-side-bar-save-disable"
                : "",
            )}
          />
          Share
        </button>
      </ShareModal>
    ),
    [
      hasApiKey,
      validApiKey,
      currentFlow,
      hasStore,
      openShareModal,
      setOpenShareModal,
    ],
  );

  // Audio recording handlers
  const handleAudioRecord = () => {
    if (isRecording) {
      console.log('Audio recording stopped');
      stopRecording();
    } else {
      console.log('Audio recording started');
      startRecording();
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    // Logic to start recording audio
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        const audioChunks: BlobPart[] = [];

        mediaRecorder.ondataavailable = event => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          console.log('Audio recording stopped');
          const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
          setAudioBlob(audioBlob);
          // Show audioBlob in an audio element
          console.log("==========URL.createObjectURL(audioBlob)==========");
          console.log(URL.createObjectURL(audioBlob));
          console.log("==========audioBlob==========");
          console.log(audioBlob);
          console.log('Sending audio to API...');
          // Send audioBlob to the API
          await sendAudioToAPI(audioBlob);
        };

        mediaRecorder.start();
        // Automatically stop recording after 5 seconds
        // setTimeout(() => {
        //   mediaRecorder.stop();
        //   setIsRecording(false);
        // }, 5000);
      });
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioToAPI = async (audioBlob: Blob) => {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    console.log('Sending audio to API...');
    const formData = new FormData();
    formData.append('file', new File([audioBlob], 'audio.mp3', { type: 'audio/mp3' }));
    formData.append('model', 'whisper-1');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: formData,
    });
    if (response.ok) {
      const data = await response.json();
      console.log(data.text);
      if (data.text) {
        updateFullFlow(data.text)
        .then(() => console.log('Flow updated successfully!'))
        .catch(error => console.error('Error updating flow:', error));
      }
    } else {
      const errorData = await response.json();
      console.error('Failed to transcribe audio', errorData);
    }
  };

  // AI copilot
  const parseCommand = async (command: string): Promise<any> => {
    const messages = [
      {
        role: 'user',
        content: command
      }
    ];

    const completion = await getCompletion(messages);
    return JSON.parse(completion);
  };

  const updateFullFlow = async (command: string) => {
    const parsedCommand = await parseCommand(command);

    const { nodes, edges } = parsedCommand;

    let flow = { ...fullFlowTemplate };

    const nodeTemplates = {
      'ChatInput': chatinputTemplate,
      'ChatOutput': chatoutputTemplate,
      'OpenAIModel': modelTemplate
    };

    // Add nodes to the flow
    const nodeTypes = nodes.map((node: any) => node.type);
    flow = addNodesToFlow(flow, nodeTemplates, nodeTypes);

    // Add edges to the flow
    edges.forEach((edge: any) => {
      const sourceType = nodeTypes.find((type: string) => edge.source.startsWith(type));
      const targetType = nodeTypes.find((type: string) => edge.target.startsWith(type));
      flow = addEdgeToFlow(flow, edge.source, edge.target, sourceType, targetType);
    });

    console.log('-----------generated flow-----------');
    console.log(flow);
    saveFullFlow(flow);
    console.log('-----------merged flow-----------');
    // mergeFlow(flow);
    setCurrentFlow(flow);
  };

  return (
    <>
      <Transition
        show={true}
        appear={true}
        enter="transition ease-out duration-300"
        enterFrom="translate-y-96"
        enterTo="translate-y-0"
        leave="transition ease-in duration-300"
        leaveFrom="translate-y-0"
        leaveTo="translate-y-96"
      >
        <div
          className={
            "shadow-round-btn-shadow hover:shadow-round-btn-shadow message-button-position flex items-center justify-center gap-7 rounded-sm border bg-muted shadow-md transition-all"
          }
        >
          <div className="flex">
            <div className="flex h-full w-full gap-1 rounded-sm transition-all">
              {hasIO ? (
                <IOModal open={open} setOpen={setOpen} disable={!hasIO}>
                  <div className="relative inline-flex w-full items-center justify-center gap-1 px-5 py-3 text-sm font-semibold transition-all duration-500 ease-in-out hover:bg-hover">
                    <ForwardedIconComponent
                      name="BotMessageSquareIcon"
                      className={"h-5 w-5 transition-all"}
                    />
                    Playground
                  </div>
                </IOModal>
              ) : (
                <div
                  className={`relative inline-flex w-full cursor-not-allowed items-center justify-center gap-1 px-5 py-3 text-sm font-semibold text-muted-foreground transition-all duration-150 ease-in-out`}
                >
                  <ForwardedIconComponent
                    name="BotMessageSquareIcon"
                    className={"h-5 w-5 transition-all"}
                  />
                  Playground
                </div>
              )}
            </div>
            <div>
              <Separator orientation="vertical" />
            </div>
            <div className="flex cursor-pointer items-center gap-2">
              {currentFlow && currentFlow.data && (
                <ApiModal
                  flow={currentFlow}
                  open={openCodeModal}
                  setOpen={setOpenCodeModal}
                >
                  <div
                    className={classNames(
                      "relative inline-flex w-full items-center justify-center gap-1 px-5 py-3 text-sm font-semibold text-foreground transition-all duration-150 ease-in-out hover:bg-hover",
                    )}
                  >
                    <ForwardedIconComponent
                      name="Code2"
                      className={"h-5 w-5"}
                    />
                    API
                  </div>
                </ApiModal>
              )}
            </div>
            <div>
              <Separator orientation="vertical" />
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`side-bar-button ${
                  !hasApiKey || !validApiKey || !hasStore
                    ? "cursor-not-allowed"
                    : "cursor-pointer"
                }`}
              >
                {ModalMemo}
              </div>
            </div>
            <div>
              <Separator orientation="vertical" />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAudioRecord}
                className="relative inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-foreground transition-all duration-150 ease-in-out hover:bg-hover"
              >
                <ForwardedIconComponent
                  name={isRecording ? "StopCircle" : "LucideAudioLines"}
                  className="h-5 w-5"
                />
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </>
  );
}
