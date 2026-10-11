import { betterAuthCollections } from '@delmaredigital/payload-better-auth';
import { betterAuthOptions } from './options.ts';

/** Keep the Payload 4 fork while enforcing Harlem Might's member identity split. */
export const memberAuthCollections = () => betterAuthCollections({
  betterAuthOptions,
  skipCollections: ['user'],
  firstUserAdmin: false,
  acknowledgeRoleGuardDisabled: true,
  customizeCollection(modelKey, collection) {
    if (modelKey !== 'account' && modelKey !== 'session') return collection;
    let relationships = 0;
    const fields = collection.fields.map(field => {
      if (!('name' in field) || field.name !== 'user') return field;
      if (field.type !== 'relationship' || typeof field.relationTo !== 'string' || field.hasMany
        || !['users', 'members'].includes(field.relationTo)) throw new Error(`Unexpected ${modelKey}.user field`);
      relationships++;
      const memberField = { ...field };
      memberField.relationTo = 'members';
      return memberField;
    });
    if (relationships !== 1) throw new Error(`Missing or duplicate ${modelKey}.user relationship`);
    return { ...collection, fields };
  },
});
