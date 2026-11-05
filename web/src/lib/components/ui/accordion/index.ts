import { Accordion as AccordionPrimitive } from "bits-ui";

import Content from "./accordion-content.svelte";
import Item from "./accordion-item.svelte";
import Trigger from "./accordion-trigger.svelte";

const Root = AccordionPrimitive.Root;

export {
  Root,
  Item,
  Trigger,
  Content,
  //
  Root as Accordion,
  Item as AccordionItem,
  Trigger as AccordionTrigger,
  Content as AccordionContent,
};
