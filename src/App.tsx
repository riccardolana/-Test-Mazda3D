import Experience from "./scene/Experience";
import TopBar from "./ui/TopBar";
import AgentPanel from "./ui/AgentPanel";
import IntroOverlay from "./ui/IntroOverlay";
import IntentToast from "./ui/IntentToast";
import BookingModal from "./ui/BookingModal";
import PasswordGate from "./ui/PasswordGate";
import InteriorCinematicLayer from "./cinematics/InteriorCinematicLayer";

export default function App() {
  return (
    <div className="app">
      <Experience />
      <InteriorCinematicLayer />
      <TopBar />
      <IntentToast />
      <AgentPanel />
      <BookingModal />
      <IntroOverlay />
      <PasswordGate />
    </div>
  );
}
