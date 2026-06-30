export interface ChangelogEntry {
	version: string;
	date: string;
	content: {
		lv: { title: string; items: string[] };
		en: { title: string; items: string[] };
	};
}

export const CHANGELOG: ChangelogEntry[] = [
	{
		version: '2026-06-30',
		date: '2026-06-30',
		content: {
			lv: {
				title: 'Jaunākās izmaiņas',
				items: [
					'Pievienota meklēšanas lauka tīrīšanas poga (×) visos sarakstos',
					'Pabeigto uzdevumu skatīšanās lapa tagad izskatās tāpat kā aktīvo uzdevumu lapa',
					'Audumu atlikusī daudzums tagad rādās uzdevumos un pasūtījumos',
					'Labots kļūda — rēķinu rediģēšanas laikā kļūdas ziņojums bija neredzams',
					'Labots kļūda — klienta izvēlnē tagad rādās telefons un e-pasts',
					'Uzlabota izvietošanas ātrums (Docker veselības pārbaude)'
				]
			},
			en: {
				title: "What's new",
				items: [
					'Added clear (×) button to all search bars',
					'Completed tasks view now matches the active tasks view',
					'Material remaining stock now shows correctly in tasks and orders',
					'Fixed invisible error message when editing invoice receiver details',
					'Client selector now shows phone and email',
					'Improved deployment speed (Docker health check)'
				]
			}
		}
	}
];
