<script lang="ts">
	import * as m from '$lib/paraglide/messages';
    import { toCurrency } from '$lib/utilities';
    
    export let history: any[] = [];

    // Helper to parse changeData safely
    function parseChanges(json: string) {
        try {
            return JSON.parse(json);
        } catch (e) {
            return [];
        }
    }

    // Helper to get field label
    function getFieldLabel(field: string) {
        switch (field) {
            case 'title': return m["projects.title_label"]();
            case 'description': return m["projects.description_label"]();
            case 'client': return m["projects.client_label"]();
            case 'assigned': return m["projects.assign_user_label"]();
            case 'dueDate': return m["projects.due_date_label"]();
            case 'seamstress': return m["projects.seamstress_label"]();
            case 'price': return m["projects.price_label"]();
            default: return field;
        }
    }

    function formatValue(field: string, val: any) {
        if (val === null || val === undefined) return '-';
        if (field === 'price') return toCurrency(val);
        return val.toString();
    }
</script>

<div class="space-y-4">
    <h3 class="text-lg font-semibold">{m["history.title"]()}</h3>
    
    {#if history.length === 0}
        <p class="text-muted-foreground text-sm">{m["history.empty"]()}</p>
    {:else}
        <div class="flex flex-col gap-4">
            {#each history as item}
                <div class="border-l-2 border-primary pl-4 py-1">
                    <div class="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <span class="font-medium text-foreground">{item.user?.name || m["history.user_unknown"]()}</span>
                        <span>•</span>
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                    
                    {#if item.changeType === 'created'}
                        <p>{m["history.created"]()}</p>
                    {:else if item.changeType === 'updated' && item.changeData}
                        {@const changes = parseChanges(item.changeData)}
                        <ul class="list-none space-y-1">
                            {#each changes as change}
                                <li class="text-sm">
                                    {m["history.field_changed"]({
                                        field: getFieldLabel(change.field),
                                        from: formatValue(change.field, change.from),
                                        to: formatValue(change.field, change.to)
                                    })}
                                </li>
                            {/each}
                        </ul>
                    {:else}
                         <p class="text-sm">{item.description}</p>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>
