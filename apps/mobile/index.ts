import { registerRootComponent } from "expo";
import App from "./src/App";

// Same as AppRegistry.registerComponent("main", () => App), set up for both Expo Go and native builds
registerRootComponent(App);
