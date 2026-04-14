export async function initAxe() {
  if (import.meta.env.DEV) {
    const React = await import("react");
    const ReactDOM = await import("react-dom");
    const axe = await import("@axe-core/react");
    axe.default(React.default, ReactDOM.default, 1000);
  }
}
