import Experience from "./scene/Experience";
import TopBar from "./ui/TopBar";
import AgentPanel from "./ui/AgentPanel";
import IntroOverlay from "./ui/IntroOverlay";
import IntentToast from "./ui/IntentToast";
import BookingModal from "./ui/BookingModal";

export default function App() {
  return (
    <div className="app">
      <Experience />
      <TopBar />
      <IntentToast />
      <AgentPanel />
      <BookingModal />
      <IntroOverlay />
    </div>
  );
}
