import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { petSoundRate, type SoundPet } from "@/lib/pet-sound";
import catAudio from "@/assets/cat-meow.mp3";
import dogAudio from "@/assets/dog-bark.mp3";

const SoundContext = createContext({ enabled: false, toggle: () => {}, play: (_pet: SoundPet, _automatic = false) => {} });
export function PetSoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const players = useRef<HTMLAudioElement[]>([]);
  const unlocked = useRef(false);
  useEffect(() => () => { players.current.forEach(audio => audio.pause()); }, []);
  const ensure = () => {
    if (!players.current.length) players.current = [new Audio(catAudio), new Audio(dogAudio)];
    return players.current;
  };
  const play = useCallback((pet: SoundPet, automatic = false) => {
    if (document.hidden || (automatic && (!enabled || !unlocked.current))) return;
    const list = ensure();
    list.forEach(audio => audio.pause());
    const next = list[pet.species === "CAT" ? 0 : 1];
    next.currentTime = 0; next.volume = 0.35; next.muted = false;
    next.preservesPitch = false; next.playbackRate = petSoundRate(pet);
    if (!automatic) { unlocked.current = true; setEnabled(true); }
    void next.play().catch((error: DOMException) => { if (!automatic && error.name !== "AbortError") toast("Tap Enable pet sounds to allow audio in this browser."); });
  }, [enabled]);
  const toggle = () => {
    if (enabled) { ensure().forEach(audio => audio.pause()); setEnabled(false); return; }
    unlocked.current = true; setEnabled(true);
    // Unlock both audio elements within the gesture for later attention alerts.
    ensure().forEach(audio => {
      audio.muted = true;
      void audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; }).catch(() => { audio.muted = false; });
    });
  };
  return <SoundContext.Provider value={{ enabled, toggle, play }}>{children}</SoundContext.Provider>;
}
export const usePetSound = () => useContext(SoundContext);
export function PetSoundToggle() {
  const { enabled, toggle } = usePetSound();
  return <Button variant="outline" onClick={toggle} aria-label={enabled ? "Mute pet sounds" : "Enable pet sounds"} aria-pressed={enabled} className="rounded-full text-xs">
    {enabled ? <Volume2 /> : <VolumeX />}{enabled ? "Sound on" : "Enable sound"}
  </Button>;
}
