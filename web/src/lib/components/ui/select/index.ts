import { Select as SelectPrimitive } from "bits-ui";

import Content from "./select-content.svelte";
import Group from "./select-group.svelte";
import Item from "./select-item.svelte";
import Label from "./select-label.svelte";
import ScrollDownButton from "./select-scroll-down-button.svelte";
import ScrollUpButton from "./select-scroll-up-button.svelte";
import Trigger from "./select-trigger.svelte";

const Root = SelectPrimitive.Root;

export {
  Root,
  Group,
  Item,
  Label,
  Content,
  Trigger,
  ScrollDownButton,
  ScrollUpButton,
  //
  Root as Select,
  Group as SelectGroup,
  Item as SelectItem,
  Label as SelectLabel,
  Content as SelectContent,
  Trigger as SelectTrigger,
  ScrollDownButton as SelectScrollDownButton,
  ScrollUpButton as SelectScrollUpButton,
};
