import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(Flip, ScrollTrigger, SplitText);

export { gsap, Flip, ScrollTrigger, SplitText };
